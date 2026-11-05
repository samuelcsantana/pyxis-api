import {
  AnnotationLimitReachedError,
  AnnotationNotFoundError,
  InvalidAnnotationError,
} from '../../../domain/errors/annotation.errors';
import {
  InvalidShareLinkError,
  ShareLinkLimitReachedError,
  ShareLinkLockedError,
  ShareLinkNotFoundError,
  SharePasswordNotSetError,
  SharePasswordRequiredError,
  WrongSharePasswordError,
} from '../../../domain/errors/share-link.errors';
import {
  GoalLimitReachedError,
  GoalNotFoundError,
  InvalidGoalError,
} from '../../../domain/errors/goal.errors';
import { HttpException, NotFoundException } from '@nestjs/common';
import {
  BillingUnavailableError,
  InvalidBillingSignatureError,
} from '../../../domain/errors/billing.errors';
import { DomainError } from '../../../domain/errors/domain.error';
import {
  BatchTooLargeError,
  OriginNotAllowedError,
  ProjectRateLimitedError,
  QuotaExceededError,
  UnknownProjectKeyError,
} from '../../../domain/errors/ingest.errors';
import { InvalidSignInCodeError, UnauthenticatedError } from '../../../domain/errors/auth.errors';
import {
  ExportLimitReachedError,
  ExportNotFoundError,
  ExportsUnavailableError,
} from '../../../domain/errors/export.errors';
import {
  OwnerStaysError,
  PeopleLimitReachedError,
  PersonNotFoundError,
} from '../../../domain/errors/people.errors';
import {
  AccountEndedError,
  AccountSuspendedError,
  ConfirmationMismatchError,
  DeletionOnHoldError,
  PlanRequiredError,
  ProjectLimitReachedError,
  SignUpBusyError,
  SubscriptionRequiredError,
} from '../../../domain/errors/account.errors';
import {
  InvalidProjectSettingsError,
  KeyLimitReachedError,
  LastPublicKeyError,
  ProjectIconNotFoundError,
  ProjectKeyNotFoundError,
  ProjectNameMismatchError,
  ProjectSuspendedError,
  ProjectNotFoundError,
} from '../../../domain/errors/project.errors';
import { InvalidRangeError } from '../../../domain/errors/query.errors';
import { UnknownCursorError } from '../../../domain/errors/subject.errors';
import { toErrorAnswer } from './error-answer';
import {
  ClientRateLimitedError,
  DashboardOriginRequiredError,
  InvalidBatchError,
  InvalidRequestError,
} from './http-errors';
import {
  InvalidSlackWebhookError,
  SlackUnavailableError,
  SlackWebhookNotFoundError,
} from '../../../domain/errors/slack.errors';

class UnmappedDomainError extends DomainError {
  readonly code = 'not_mapped';

  constructor() {
    super('A rule without an HTTP status.');
  }
}

const INTERNAL = {
  body: {
    status_code: 500,
    error: 'internal_error',
    message: 'Something went wrong on our side.',
  },
  headers: {},
  unexpected: true,
};

describe('toErrorAnswer', () => {
  it.each([
    [new BatchTooLargeError(), 413, 'batch_too_large'],
    [new UnknownProjectKeyError(), 401, 'unknown_key'],
    [new OriginNotAllowedError('project-1', null), 403, 'origin_not_allowed'],
    [new InvalidSignInCodeError(), 400, 'invalid_code'],
    [new UnauthenticatedError(), 401, 'unauthenticated'],
    [new InvalidRangeError(), 400, 'invalid_range'],
    [new UnknownCursorError(), 400, 'invalid_cursor'],
    [new ProjectNotFoundError(), 404, 'project_not_found'],
    [new ProjectIconNotFoundError(), 404, 'project_icon_not_found'],
    [new InvalidBillingSignatureError(), 400, 'invalid_billing_signature'],
    [new BillingUnavailableError('subscriptions.retrieve failed'), 503, 'billing_unavailable'],
    [new InvalidProjectSettingsError('origin', 'Bad origin.'), 400, 'invalid_project_settings'],
    [new ProjectLimitReachedError(3), 409, 'project_limit_reached'],
    [new InvalidGoalError('name', 'Bad name.'), 400, 'invalid_goal'],
    [new GoalNotFoundError(), 404, 'goal_not_found'],
    [new GoalLimitReachedError(10), 409, 'goal_limit_reached'],
    [new InvalidShareLinkError('name', 'Bad name.'), 400, 'invalid_share_link'],
    [new ShareLinkNotFoundError(), 404, 'share_link_not_found'],
    [new ShareLinkLimitReachedError(10), 409, 'share_link_limit_reached'],
    [new SharePasswordRequiredError(), 401, 'share_password_required'],
    [new WrongSharePasswordError(), 401, 'wrong_share_password'],
    [new SharePasswordNotSetError(), 409, 'share_password_not_set'],
    [new InvalidAnnotationError('text', 'Too long.'), 400, 'invalid_annotation'],
    [new AnnotationNotFoundError(), 404, 'annotation_not_found'],
    [new AnnotationLimitReachedError(1000), 409, 'annotation_limit_reached'],
    [new InvalidSlackWebhookError(), 400, 'invalid_slack_webhook'],
    [new SlackWebhookNotFoundError(), 404, 'slack_webhook_not_found'],
    [new SlackUnavailableError(), 503, 'slack_unavailable'],
    [new SubscriptionRequiredError(), 409, 'subscription_required'],
    [new PlanRequiredError('slack_alerts'), 403, 'plan_required'],
    [new ProjectNameMismatchError(), 409, 'project_name_mismatch'],
    [new ProjectKeyNotFoundError(), 404, 'key_not_found'],
    [new LastPublicKeyError(), 409, 'last_public_key'],
    [new KeyLimitReachedError(5), 409, 'key_limit_reached'],
    [new PeopleLimitReachedError(3), 409, 'people_limit_reached'],
    [new OwnerStaysError(), 409, 'owner_stays'],
    [new PersonNotFoundError(), 404, 'person_not_found'],
    [new ExportLimitReachedError(3), 429, 'export_limit_reached'],
    [new SignUpBusyError(), 429, 'sign_up_busy'],
    [new ExportNotFoundError(), 404, 'export_not_found'],
    [new AccountEndedError(), 409, 'account_ended'],
    [new DeletionOnHoldError(), 409, 'deletion_on_hold'],
    [new ConfirmationMismatchError(), 409, 'confirmation_mismatch'],
    [new ExportsUnavailableError('EXPORT_BUCKET is not set'), 503, 'exports_unavailable'],
  ])('maps %s to its status and code', (error, status, code) => {
    expect(toErrorAnswer(error)).toEqual({
      body: { status_code: status, error: code, message: error.message },
      headers: {},
      unexpected: false,
    });
  });

  it('answers a rate-limited project with Retry-After and a CORS grant for its origin', () => {
    expect(toErrorAnswer(new ProjectRateLimitedError(17, 'https://shop.example.com'))).toEqual({
      body: { status_code: 429, error: 'rate_limited', message: expect.any(String) as string },
      headers: {
        'retry-after': '17',
        'access-control-allow-origin': 'https://shop.example.com',
        vary: 'Origin',
      },
      unexpected: false,
    });
  });

  it('answers a paused account with 403 and a CORS grant, so the tracker reads it and drops the batch', () => {
    expect(
      toErrorAnswer(
        new QuotaExceededError(new Date('2026-11-01T00:00:00.000Z'), 'https://shop.example.com'),
      ),
    ).toEqual({
      body: { status_code: 403, error: 'quota_exceeded', message: expect.any(String) as string },
      headers: { 'access-control-allow-origin': 'https://shop.example.com', vary: 'Origin' },
      unexpected: false,
    });
  });

  it('answers a suspended account with 403 and a CORS grant when a batch was refused', () => {
    expect(toErrorAnswer(new AccountSuspendedError('https://shop.example.com'))).toEqual({
      body: { status_code: 403, error: 'account_suspended', message: expect.any(String) as string },
      headers: { 'access-control-allow-origin': 'https://shop.example.com', vary: 'Origin' },
      unexpected: false,
    });
  });

  it('answers a project whose reception is suspended with 403 and a CORS grant', () => {
    expect(toErrorAnswer(new ProjectSuspendedError('https://shop.example.com'))).toEqual({
      body: { status_code: 403, error: 'project_suspended', message: expect.any(String) as string },
      headers: { 'access-control-allow-origin': 'https://shop.example.com', vary: 'Origin' },
      unexpected: false,
    });
  });

  it.each([
    ['an unknown key', new UnknownProjectKeyError('https://gone.example.com'), 401, 'unknown_key'],
    [
      'an origin the project does not allow',
      new OriginNotAllowedError('project-1', 'https://gone.example.com'),
      403,
      'origin_not_allowed',
    ],
  ])(
    'lets the page that sent a batch with %s read the refusal, so the tracker drops it',
    (_, error, status, code) => {
      expect(toErrorAnswer(error)).toEqual({
        body: { status_code: status, error: code, message: error.message },
        headers: { 'access-control-allow-origin': 'https://gone.example.com', vary: 'Origin' },
        unexpected: false,
      });
    },
  );

  it.each([
    ['an unknown key', new UnknownProjectKeyError('null')],
    ['an origin the project does not allow', new OriginNotAllowedError('project-1', 'null')],
  ])('grants nothing to an opaque origin refused for %s', (_, error) => {
    expect(toErrorAnswer(error).headers).toEqual({});
  });

  it('answers a suspended account in the dashboard with a plain 403', () => {
    expect(toErrorAnswer(new AccountSuspendedError())).toEqual({
      body: { status_code: 403, error: 'account_suspended', message: expect.any(String) as string },
      headers: {},
      unexpected: false,
    });
  });

  it('treats a domain error without a status as unexpected', () => {
    expect(toErrorAnswer(new UnmappedDomainError())).toEqual(INTERNAL);
  });

  it('answers an invalid batch with 400', () => {
    expect(toErrorAnswer(new InvalidBatchError()).body).toEqual({
      status_code: 400,
      error: 'invalid_batch',
      message: 'The batch does not match the contract.',
    });
  });

  it('answers a body that breaks its schema with 400', () => {
    expect(toErrorAnswer(new InvalidRequestError()).body).toEqual({
      status_code: 400,
      error: 'invalid_request',
      message: 'The request body does not match the contract.',
    });
  });

  it('answers a dashboard call from another origin with 403', () => {
    expect(toErrorAnswer(new DashboardOriginRequiredError())).toEqual({
      body: {
        status_code: 403,
        error: 'origin_not_allowed',
        message: 'This request must come from the dashboard.',
      },
      headers: {},
      unexpected: false,
    });
  });

  it('answers a rate-limited address with 429 and Retry-After, without a CORS grant', () => {
    expect(toErrorAnswer(new ClientRateLimitedError(42))).toEqual({
      body: { status_code: 429, error: 'rate_limited', message: expect.any(String) as string },
      headers: { 'retry-after': '42' },
      unexpected: false,
    });
  });

  it('answers a locked share link exactly as a rate-limited address, so neither says which', () => {
    expect(toErrorAnswer(new ShareLinkLockedError(42))).toEqual(
      toErrorAnswer(new ClientRateLimitedError(42)),
    );
  });

  it('answers a Nest HTTP exception with a generic message that echoes nothing', () => {
    expect(toErrorAnswer(new NotFoundException('Cannot POST /v1/secret?email=x')).body).toEqual({
      status_code: 404,
      error: 'not_found',
      message: 'Nothing lives at this address.',
    });
  });

  it.each([
    [{ statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' }, 413, 'payload_too_large'],
    [{ statusCode: 415, code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE' }, 415, 'unsupported_media_type'],
    [{ statusCode: 400, code: 'FST_ERR_CTP_INVALID_JSON_BODY' }, 400, 'invalid_request'],
  ])('maps a framework error with status %j', (error, status, code) => {
    expect(toErrorAnswer(error).body).toMatchObject({ status_code: status, error: code });
  });

  it.each([
    ['an HTTP status it does not know', new HttpException('teapot', 418)],
    ['a status that is not a number', { statusCode: '413' }],
    ['a plain error', new Error('boom')],
    ['a value that is not an object', 'boom'],
    ['null', null],
  ])('treats %s as unexpected', (_, exception) => {
    expect(toErrorAnswer(exception)).toEqual(INTERNAL);
  });
});
