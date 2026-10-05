import awsLambdaFastify, { type PromiseHandler } from '@fastify/aws-lambda';
import type { FastifyInstance } from 'fastify';

type ResponseHeaders = Readonly<Record<string, string | string[] | number | undefined>>;

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

export function createLambdaProxy(fastify: FastifyInstance): PromiseHandler {
  return awsLambdaFastify(fastify, {
    enforceBase64: (response) => isBinaryResponse(response.headers as ResponseHeaders),
  });
}
