import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendWebResponse, webRequestOf } from './web-exchange';

const API_ORIGIN = 'https://api.example.com';
const MESSAGE = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}';

function fastifyRequest(
  method: string,
  headers: Record<string, string | string[]>,
  rawBody?: Buffer,
): RawBodyRequest<FastifyRequest> {
  return { method, url: '/mcp', headers, rawBody } as unknown as RawBodyRequest<FastifyRequest>;
}

interface RecordedReply {
  status?: number;
  headers: Record<string, string>;
  body?: unknown;
}

function recordingReply(recorded: RecordedReply): FastifyReply {
  const reply = {
    status(code: number) {
      recorded.status = code;
      return reply;
    },
    header(name: string, value: string) {
      recorded.headers[name] = value;
      return reply;
    },
    send(body: unknown) {
      recorded.body = body;
      return Promise.resolve(reply);
    },
  };
  return reply as unknown as FastifyReply;
}

describe('webRequestOf', () => {
  it('carries the message and only the headers the transport reads', async () => {
    const request = webRequestOf(
      fastifyRequest(
        'POST',
        {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-11-25',
          authorization: 'Bearer pyxis_oat_secret',
          cookie: 'pyxis_session=secret',
          'x-repeated': ['one', 'two'],
        },
        Buffer.from(MESSAGE),
      ),
      API_ORIGIN,
    );

    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.example.com/mcp');
    expect(Object.fromEntries(request.headers)).toEqual({
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25',
    });
    await expect(request.text()).resolves.toBe(MESSAGE);
  });

  it('keeps the Origin header, so the transport can refuse a web page', () => {
    const request = webRequestOf(
      fastifyRequest('POST', { origin: 'https://evil.example.com' }, Buffer.from(MESSAGE)),
      API_ORIGIN,
    );

    expect(request.headers.get('origin')).toBe('https://evil.example.com');
  });

  it('sends no body with a GET', () => {
    const request = webRequestOf(fastifyRequest('GET', {}, Buffer.from(MESSAGE)), API_ORIGIN);

    expect(request.body).toBeNull();
  });

  it('sends no body when none arrived', () => {
    expect(webRequestOf(fastifyRequest('DELETE', {}), API_ORIGIN).body).toBeNull();
  });
});

describe('sendWebResponse', () => {
  it('writes the status, the headers and the body of the answer', async () => {
    const recorded: RecordedReply = { headers: {} };

    await sendWebResponse(
      recordingReply(recorded),
      new Response(MESSAGE, { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    expect(recorded).toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: MESSAGE,
    });
  });

  it('writes an answer without a body', async () => {
    const recorded: RecordedReply = { headers: {} };

    await sendWebResponse(recordingReply(recorded), new Response(null, { status: 202 }));

    expect(recorded).toEqual({ status: 202, headers: {}, body: '' });
  });
});
