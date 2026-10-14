import awsLambdaFastify, { type PromiseHandler } from '@fastify/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { FastifyInstance } from 'fastify';

type ResponseHeaders = Readonly<Record<string, string | string[] | number | undefined>>;

export type QueryValues = Readonly<Record<string, string | readonly string[]>>;

const TEXT_CONTENT_TYPE =
  /^(text\/|application\/(json|xml|javascript)|application\/[a-z0-9.+-]+\+(json|xml))/i;

function headerText(headers: ResponseHeaders, name: string): string {
  const value = headers[name];
  return value === undefined ? '' : String(value);
}

export function isBinaryResponse(headers: ResponseHeaders): boolean {
  const encoding = headerText(headers, 'content-encoding').toLowerCase();
  if (encoding !== '' && encoding !== 'identity') {
    return true;
  }
  const contentType = headerText(headers, 'content-type');
  return contentType !== '' && !TEXT_CONTENT_TYPE.test(contentType);
}

export function queryFromRawQueryString(rawQueryString: string): QueryValues {
  const query = new Map<string, string | readonly string[]>();
  for (const [key, value] of new URLSearchParams(rawQueryString)) {
    const previous = query.get(key);
    if (previous === undefined) {
      query.set(key, value);
    } else {
      query.set(key, [...(typeof previous === 'string' ? [previous] : previous), value]);
    }
  }
  return Object.fromEntries(query);
}

function withQueryFromRawQueryString(event: APIGatewayProxyEventV2) {
  return {
    ...event,
    queryStringParameters: undefined,
    multiValueQueryStringParameters: queryFromRawQueryString(event.rawQueryString),
  };
}

export function createLambdaProxy(fastify: FastifyInstance): PromiseHandler {
  const proxy = awsLambdaFastify(fastify, {
    enforceBase64: (response) => isBinaryResponse(response.headers as ResponseHeaders),
    parseCommaSeparatedQueryParams: false,
  });
  return (event: APIGatewayProxyEventV2, context) =>
    proxy(withQueryFromRawQueryString(event), context);
}
