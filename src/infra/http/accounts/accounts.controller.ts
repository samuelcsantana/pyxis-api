import {
  Body,
  Controller,
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
import { CloseAccountUseCase } from '../../../usecases/accounts/close-account.usecase';
import { WithdrawToFreePlanUseCase } from '../../../usecases/accounts/withdraw-to-free-plan.usecase';
import {
  ListMyAccountsUseCase,
  type MyAccount,
} from '../../../usecases/accounts/list-my-accounts.usecase';
import { OpenBillingPortalUseCase } from '../../../usecases/accounts/open-billing-portal.usecase';
import { StartCheckoutUseCase } from '../../../usecases/accounts/start-checkout.usecase';
import { adminOf, DashboardOriginGuard, SessionGuard } from '../auth/auth.guards';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { AUTH_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  accountIdSchema,
  type BillingRedirectBody,
  billingRedirectSchema,
  type CloseAccountBody,
  closeAccountSchema,
  type ClosedAccountBody,
  closedAccountSchema,
  type WithdrawnBody,
  withdrawnSchema,
  type CheckoutRequestBody,
  checkoutRequestSchema,
  type MyAccountsBody,
  myAccountsSchema,
  type PortalRequestBody,
  portalRequestSchema,
} from './accounts.schemas';

type MyAccountBody = MyAccountsBody['accounts'][number];

function isoOrNull(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

export function myAccountBody({
  account,
  role,
  month,
  usage,
  limits,
  pauseAtEvents,
}: MyAccount): MyAccountBody {
  const owner = role === 'owner';
  return {
    id: account.id,
    role,
    status: account.status,
    billing_interval: owner ? account.billingInterval : null,
    trial_ends_at: owner ? isoOrNull(account.trialEndsAt) : null,
    current_period_ends_at: owner ? isoOrNull(account.currentPeriodEndsAt) : null,
    access_ends_at: isoOrNull(account.accessEndsAt),
    ingestion_paused_until: isoOrNull(account.ingestionPausedUntil),
    quota_pause_exempt_until: isoOrNull(account.quotaPauseExemptUntil),
    free_waitlisted_at: owner ? isoOrNull(account.freeWaitlistedAt) : null,
    suspended_at: isoOrNull(account.suspendedAt),
    suspension_reason: owner ? account.suspensionReason : null,
    deletion_held_at: owner ? isoOrNull(account.deletionHeldAt) : null,
    month,
    events_this_month: usage === null ? null : usage.events,
    measured_at: usage === null ? null : usage.updatedAt.toISOString(),
    limits: {
      events_per_month: limits.eventsPerMonth,
      projects: limits.projects,
      people: limits.people,
      pause_at_events: pauseAtEvents,
    },
  };
}

@ApiTags('accounts')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('v1')
@SkipThrottle(skipThrottlersExcept(AUTH_THROTTLER))
export class AccountsController {
  constructor(
    private readonly listMyAccounts: ListMyAccountsUseCase,
    private readonly startCheckout: StartCheckoutUseCase,
    private readonly openBillingPortal: OpenBillingPortalUseCase,
    private readonly closeAccount: CloseAccountUseCase,
    private readonly withdrawToFreePlan: WithdrawToFreePlanUseCase,
  ) {}

  @Get('me/accounts')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'The accounts the signed-in admin owns or reads a project of' })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: myAccountsSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: errorResponseSchema })
  async accounts(@Req() request: FastifyRequest): Promise<MyAccountsBody> {
    const accounts = await this.listMyAccounts.execute(adminOf(request).id);
    return { accounts: accounts.map(myAccountBody) };
  }

  @Post('accounts/:accountId/checkout')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open a Stripe Checkout for the account',
    description:
      'Only the owner, while the account has no running subscription. The first one comes with ' +
      'the free trial while the trial is offered. An account on the free plan subscribes with no ' +
      'trial, and an ended account, not yet deleted, may subscribe again, both even while ' +
      'sign-up is closed; leaving their Checkout goes back to /account.',
  })
  @ApiParam({ name: 'accountId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: billingRedirectSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, standardSchema: errorResponseSchema })
  async checkout(
    @Req() request: FastifyRequest,
    @Param('accountId', new SchemaPipe(accountIdSchema)) accountId: string,
    @Body({ schema: checkoutRequestSchema, pipes: [new SchemaPipe(checkoutRequestSchema)] })
    body: CheckoutRequestBody,
  ): Promise<BillingRedirectBody> {
    const admin = adminOf(request);
    return this.startCheckout.execute({
      adminUserId: admin.id,
      ownerEmail: admin.email,
      accountId,
      interval: body.interval,
      language: resolveEmailLanguage(body.locale),
    });
  }

  @Post('accounts/:accountId/portal')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Open Stripe's billing portal for the account's owner" })
  @ApiParam({ name: 'accountId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: billingRedirectSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, standardSchema: errorResponseSchema })
  async portal(
    @Req() request: FastifyRequest,
    @Param('accountId', new SchemaPipe(accountIdSchema)) accountId: string,
    @Body({ schema: portalRequestSchema, pipes: [new SchemaPipe(portalRequestSchema)] })
    body: PortalRequestBody,
  ): Promise<BillingRedirectBody> {
    return this.openBillingPortal.execute({
      adminUserId: adminOf(request).id,
      accountId,
      language: resolveEmailLanguage(body.locale),
    });
  }

  @Post('accounts/:accountId/withdraw')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw from the paid plan and go back to the free plan',
    description:
      'Only the owner, while the free plan is open, within 7 days of the first payment of the ' +
      'subscription: cancels it at once, refunds that payment in full and puts the account back ' +
      'on the free plan, with its projects and data. 409 free_plan_closed, ' +
      'withdrawal_unavailable (no paid subscription) or withdrawal_window_closed otherwise.',
  })
  @ApiParam({ name: 'accountId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: withdrawnSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, standardSchema: errorResponseSchema })
  async withdraw(
    @Req() request: FastifyRequest,
    @Param('accountId', new SchemaPipe(accountIdSchema)) accountId: string,
  ): Promise<WithdrawnBody> {
    const withdrawn = await this.withdrawToFreePlan.execute({
      adminUserId: adminOf(request).id,
      accountId,
    });
    return { status: 'free', refunded_amount: withdrawn.refundedAmount };
  }

  @Post('accounts/:accountId/close')
  @UseGuards(DashboardOriginGuard, SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close an account the admin owns',
    description:
      'Cancels the subscription at once, refunds a first payment made in the last seven days, ' +
      'revokes the keys of its projects and deletes everything thirty days later.',
  })
  @ApiParam({ name: 'accountId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: closedAccountSchema })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.CONFLICT, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, standardSchema: errorResponseSchema })
  async close(
    @Req() request: FastifyRequest,
    @Param('accountId', new SchemaPipe(accountIdSchema)) accountId: string,
    @Body({ schema: closeAccountSchema, pipes: [new SchemaPipe(closeAccountSchema)] })
    body: CloseAccountBody,
  ): Promise<ClosedAccountBody> {
    const admin = adminOf(request);
    const closed = await this.closeAccount.execute({
      adminUserId: admin.id,
      ownerEmail: admin.email,
      ownerLanguage: admin.emailLanguage,
      accountId,
      confirmEmail: body.confirm_email,
    });
    return {
      access_ends_at: closed.accessEndsAt.toISOString(),
      deletion_on: closed.deletionOn.toISOString(),
      refunded_amount: closed.refundedAmount,
    };
  }
}
