import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SHARE_TOKEN_PATTERN } from '../../../domain/share-links/share-link';
import { UnlockShareLinkUseCase } from '../../../usecases/share-links/unlock-share-link.usecase';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import { SHARE_UNLOCK_THROTTLER, skipThrottlersExcept } from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import {
  type ShareUnlockBody,
  shareUnlockSchema,
  type UnlockShareLinkBody,
  unlockShareLinkSchema,
} from './share-links.schemas';

@ApiTags('shared reports')
@Controller('v1/shared/:token/unlock')
@SkipThrottle(skipThrottlersExcept(SHARE_UNLOCK_THROTTLER))
@UseGuards(ClientAddressThrottlerGuard)
export class ShareUnlockController {
  constructor(private readonly unlockShareLink: UnlockShareLinkUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trade the password of a share link for an unlock of its reports',
    description:
      'No session. The answer is sent as Authorization: Bearer pyxis_su_… with the other ' +
      '/v1/shared/{token} routes of this link.',
  })
  @ApiParam({
    name: 'token',
    description: 'The token answered when the link was created',
    schema: { type: 'string', pattern: SHARE_TOKEN_PATTERN.source },
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: shareUnlockSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'The password does not open this link (wrong_share_password).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'No open link has this token (share_link_not_found), the same answer as the other ' +
      'shared routes.',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The link has no password (share_password_not_set).',
    standardSchema: errorResponseSchema,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description:
      'Too many attempts from this address, or too many wrong passwords for the link; the two ' +
      'answers are the same (rate_limited), with Retry-After.',
    standardSchema: errorResponseSchema,
  })
  async unlock(
    @Param('token') token: string,
    @Body({ schema: unlockShareLinkSchema, pipes: [new SchemaPipe(unlockShareLinkSchema)] })
    body: UnlockShareLinkBody,
  ): Promise<ShareUnlockBody> {
    const unlocked = await this.unlockShareLink.execute(token, body.password);
    return { unlock: unlocked.unlock, expires_at: unlocked.expiresAt.toISOString() };
  }
}
