import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';

export const CLOUDFRONT_VIEWER_ADDRESS_HEADER = 'cloudfront-viewer-address';

export function singleHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function withoutPort(address: string): string {
  const lastColon = address.lastIndexOf(':');
  return lastColon === -1 ? address : address.slice(0, lastColon);
}

function trustedAddress(request: FastifyRequest, header: string): string | undefined {
  const value = singleHeader(request, header)?.trim();
  if (value === undefined) {
    return undefined;
  }
  const candidate = header === CLOUDFRONT_VIEWER_ADDRESS_HEADER ? withoutPort(value) : value;
  return isIP(candidate) === 0 ? undefined : candidate;
}

export function getClientIp(request: FastifyRequest, trustedHeader: string | undefined): string {
  const fromHeader =
    trustedHeader === undefined ? undefined : trustedAddress(request, trustedHeader);
  return fromHeader ?? request.ip;
}

export interface ClientIpSources {
  readonly trustedHeader: string | null;
  readonly cloudfrontViewerAddress: boolean;
  readonly xForwardedForHops: number;
  readonly resolvedFrom: 'header' | 'socket';
}

export function describeClientIpSources(
  request: FastifyRequest,
  trustedHeader: string | undefined,
): ClientIpSources {
  const forwardedFor = singleHeader(request, 'x-forwarded-for');
  const fromHeader =
    trustedHeader === undefined ? undefined : trustedAddress(request, trustedHeader);
  return {
    trustedHeader: trustedHeader ?? null,
    cloudfrontViewerAddress: singleHeader(request, CLOUDFRONT_VIEWER_ADDRESS_HEADER) !== undefined,
    xForwardedForHops: forwardedFor === undefined ? 0 : forwardedFor.split(',').length,
    resolvedFrom: fromHeader === undefined ? 'socket' : 'header',
  };
}
