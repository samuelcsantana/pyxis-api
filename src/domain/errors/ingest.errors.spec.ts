import { DomainError } from './domain.error';
import {
  BatchTooLargeError,
  OriginNotAllowedError,
  ProjectRateLimitedError,
  QuotaExceededError,
  UnknownProjectKeyError,
} from './ingest.errors';

const RESUMES_AT = new Date('2026-11-01T00:00:00.000Z');

describe('ingestion errors', () => {
  it.each([
    [new BatchTooLargeError(), 'batch_too_large', 'BatchTooLargeError'],
    [new UnknownProjectKeyError(), 'unknown_key', 'UnknownProjectKeyError'],
    [new OriginNotAllowedError('project-1', null), 'origin_not_allowed', 'OriginNotAllowedError'],
    [
      new ProjectRateLimitedError(12, 'https://shop.example.com'),
      'rate_limited',
      'ProjectRateLimitedError',
    ],
    [
      new QuotaExceededError(RESUMES_AT, 'https://shop.example.com'),
      'quota_exceeded',
      'QuotaExceededError',
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

  it('tells a paused account when events are taken again, and which origin was allowed', () => {
    const error = new QuotaExceededError(RESUMES_AT, 'https://shop.example.com');

    expect(error.pausedUntil).toBe(RESUMES_AT);
    expect(error.allowedOrigin).toBe('https://shop.example.com');
    expect(error.message).toContain('2026-11-01T00:00:00.000Z');
  });

  it('keeps the origin of a batch sent with an unknown key, or none when it is not known', () => {
    expect(new UnknownProjectKeyError('https://gone.example.com').requestOrigin).toBe(
      'https://gone.example.com',
    );
    expect(new UnknownProjectKeyError().requestOrigin).toBeNull();
  });

  it('names the project and the origin it refused', () => {
    const error = new OriginNotAllowedError('project-1', 'https://www.shop.example.com');

    expect(error.projectId).toBe('project-1');
    expect(error.requestOrigin).toBe('https://www.shop.example.com');
  });

  it('states the batch limit in the message', () => {
    expect(new BatchTooLargeError().message).toContain('50');
  });
});
