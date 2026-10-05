import type { FastifyReply } from 'fastify';
import { allowOrigin, answerPreflight, PREFLIGHT_MAX_AGE_SECONDS } from './ingest-cors';

function replySpy() {
  const headers: Record<string, string> = {};
  const reply = {
    header(name: string, value: string) {
      headers[name] = value;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, headers };
}

describe('allowOrigin', () => {
  it('grants the origin and marks the answer as varying by origin', () => {
    const { reply, headers } = replySpy();

    allowOrigin(reply, 'https://shop.example.com');

    expect(headers).toEqual({
      'access-control-allow-origin': 'https://shop.example.com',
      vary: 'Origin',
    });
  });
});

describe('answerPreflight', () => {
  it('lets any origin send a text/plain POST, without credentials', () => {
    const { reply, headers } = replySpy();

    answerPreflight(reply, 'https://anywhere.example.com');

    expect(headers).toEqual({
      vary: 'Origin',
      'access-control-allow-origin': 'https://anywhere.example.com',
      'access-control-allow-methods': 'POST',
      'access-control-allow-headers': 'Content-Type',
      'access-control-max-age': String(PREFLIGHT_MAX_AGE_SECONDS),
    });
  });

  it('grants nothing to a preflight without an origin', () => {
    const { reply, headers } = replySpy();

    answerPreflight(reply, undefined);

    expect(headers).toEqual({ vary: 'Origin' });
  });
});
