import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { ShareLink } from '../../../domain/share-links/share-link';
import { OpenShareLinkUseCase } from '../../../usecases/share-links/open-share-link.usecase';

declare module 'fastify' {
  interface FastifyRequest {
    shareLink?: ShareLink;
  }
}

type ShareRequest = FastifyRequest<{ Params: Partial<Record<'token', string>> }>;

@Injectable()
export class ShareLinkGuard implements CanActivate {
  constructor(private readonly openShareLink: OpenShareLinkUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ShareRequest>();
    const shared = await this.openShareLink.execute(request.params.token ?? '');
    request.shareLink = shared.link;
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
