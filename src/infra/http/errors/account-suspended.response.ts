import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { errorResponseSchema } from '../ingest/ingest.schemas';

export const ACCOUNT_SUSPENDED_DESCRIPTION =
  "The project's account is suspended for abuse (account_suspended).";

export const SUSPENDED_OR_FOREIGN_ORIGIN_DESCRIPTION =
  'The request did not come from the dashboard, or the account is suspended for abuse ' +
  '(account_suspended).';

export function ApiAccountSuspended(
  description: string = ACCOUNT_SUSPENDED_DESCRIPTION,
): MethodDecorator & ClassDecorator {
  return ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description,
    standardSchema: errorResponseSchema,
  });
}
