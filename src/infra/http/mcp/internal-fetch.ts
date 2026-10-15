import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Fetch } from 'pyxis-mcp';

const READ_METHOD = 'GET';
const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([204, 205, 304]);

export class ForeignAddressError extends Error {
  constructor(origin: string) {
    super(`A tool asked for ${origin}, which is not this API.`);
    this.name = 'ForeignAddressError';
  }
}

function headersOf(init: RequestInit): Record<string, string> {
  return Object.fromEntries(new Headers(init.headers));
}

function headerPairsOf(injected: LightMyRequestResponse): [string, string][] {
  return Object.entries(injected.headers).flatMap(([name, value]) =>
    [value]
      .flat()
      .filter((item) => item !== undefined)
      .map((item): [string, string] => [name, String(item)]),
  );
}

function webResponseOf(injected: LightMyRequestResponse): Response {
  const body = NULL_BODY_STATUSES.has(injected.statusCode) ? null : injected.body;
  return new Response(body, {
    status: injected.statusCode,
    headers: new Headers(headerPairsOf(injected)),
  });
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error('The request was aborted.');
}

function untilAborted<T>(work: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
  if (signal === null || signal === undefined) {
    return work;
  }
  if (signal.aborted) {
    return Promise.reject(abortReason(signal));
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', abort, { once: true });
    void work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

export function createInternalFetch(fastify: FastifyInstance, apiOrigin: string): Fetch {
  return async (url, init) => {
    const target = new URL(url);
    if (target.origin !== apiOrigin) {
      throw new ForeignAddressError(target.origin);
    }
    const injected = await untilAborted(
      fastify.inject({
        method: READ_METHOD,
        url: `${target.pathname}${target.search}`,
        headers: headersOf(init),
      }),
      init.signal,
    );
    return webResponseOf(injected);
  };
}
