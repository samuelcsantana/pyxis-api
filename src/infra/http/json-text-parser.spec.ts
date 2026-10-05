import Fastify from 'fastify';
import { InvalidJsonBodyError, parseJsonText, registerJsonTextParser } from './json-text-parser';

describe('parseJsonText', () => {
  it('parses JSON text', () => {
    expect(parseJsonText('{"events":[1]}')).toEqual({ events: [1] });
  });

  it('turns broken JSON into a 400 error', () => {
    expect(() => parseJsonText('{"events":')).toThrow(InvalidJsonBodyError);
    expect(new InvalidJsonBodyError().statusCode).toBe(400);
  });
});

describe('registerJsonTextParser', () => {
  const fastify = Fastify();
  registerJsonTextParser(fastify);
  fastify.post('/echo', (request) => Promise.resolve({ body: request.body }));

  afterAll(async () => {
    await fastify.close();
  });

  it('reads a text/plain body as JSON, the way sendBeacon and a simple CORS request send it', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      payload: '{"key":"value"}',
    });

    expect(response.json()).toEqual({ body: { key: 'value' } });
  });

  it('answers 400 to a text/plain body that is not JSON', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'text/plain' },
      payload: 'not json',
    });

    expect(response.statusCode).toBe(400);
  });
});
