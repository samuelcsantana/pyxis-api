import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { SharePasswordRequiredError } from '../../../domain/errors/share-link.errors';
import type { ShareLink } from '../../../domain/share-links/share-link';
import { shareUnlockFromAuthorization } from '../../../domain/share-links/share-unlock';
import { OpenShareLinkUseCase } from '../../../usecases/share-links/open-share-link.usecase';
import { singleHeader } from '../request-headers';

declare module 'fastify' {
  interface FastifyRequest {
    shareLink?: ShareLink;
    shareUnlocked?: boolean;
  }
}

type ShareRequest = FastifyRequest<{ Params: Partial<Record<'token', string>> }>;

const LOCKED_SHARE_LINK_ALLOWED = 'pyxis:locked-share-link-allowed';

export const AllowLockedShareLink = () => SetMetadata(LOCKED_SHARE_LINK_ALLOWED, true);

@Injectable()
export class ShareLinkGuard implements CanActivate {
  constructor(
    private readonly openShareLink: OpenShareLinkUseCase,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ShareRequest>();
    const shared = await this.openShareLink.execute(
      request.params.token ?? '',
      shareUnlockFromAuthorization(singleHeader(request, 'authorization')),
    );
    const lockedAllowed = this.reflector.get<boolean | undefined>(
      LOCKED_SHARE_LINK_ALLOWED,
      context.getHandler(),
    );
    if (!shared.unlocked && lockedAllowed !== true) {
      throw new SharePasswordRequiredError();
    }
    request.shareLink = shared.link;
    request.shareUnlocked = shared.unlocked;
    request.project = shared.project;
    request.goals = shared.goals;
    return true;
  }
}

export function shareLinkOf(request: FastifyRequest): ShareLink {
  if (request.shareLink === undefined) {
    throw new Error('ShareLinkGuard must run before a route reads the share link.');
  }
  return request.shareLink;
}

export function isShareUnlocked(request: FastifyRequest): boolean {
  if (request.shareUnlocked === undefined) {
    throw new Error('ShareLinkGuard must run before a route reads whether the link is unlocked.');
  }
  return request.shareUnlocked;
}
