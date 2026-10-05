import { DomainError } from './domain.error';
import {
  BatchTooLargeError,
  OriginNotAllowedError,
  ProjectRateLimitedError,
  UnknownProjectKeyError,
} from './ingest.errors';

describe('ingestion errors', () => {
  it.each([
    [new BatchTooLargeError(), 'batch_too_large', 'BatchTooLargeError'],
    [new UnknownProjectKeyError(), 'unknown_key', 'UnknownProjectKeyError'],
    [new OriginNotAllowedError(), 'origin_not_allowed', 'OriginNotAllowedError'],
    [
      new ProjectRateLimitedError(12, 'https://shop.example.com'),
      'rate_limited',
      'ProjectRateLimitedError',
    ],
  ])('%s carries a stable machine code and its class name', (error, code, name) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
    expect(error.name).toBe(name);
    expect(error.message).not.toBe('');
  });

  it('tells a rate-limited caller how long to wait and which origin was allowed', () => {
    const error = new ProjectRateLimitedError(12, 'https://shop.example.com');

    expect(error.retryAfterSeconds).toBe(12);
    expect(error.allowedOrigin).toBe('https://shop.example.com');
  });

  it('states the batch limit in the message', () => {
    expect(new BatchTooLargeError().message).toContain('50');
  });
});
