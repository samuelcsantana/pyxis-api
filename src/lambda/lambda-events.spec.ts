import { isFunctionUrlEvent } from './lambda-events';

describe('isFunctionUrlEvent', () => {
  it('recognizes a Function URL request', () => {
    expect(
      isFunctionUrlEvent({ rawPath: '/health', requestContext: { http: { method: 'GET' } } }),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'event'],
    ['an event without a request context', { rawPath: '/' }],
    ['a request context that is not an object', { requestContext: 'x' }],
    ['a request context without http', { requestContext: {} }],
    ['an http part that is not an object', { requestContext: { http: 'GET' } }],
    ['an http part without a method', { requestContext: { http: {} } }],
    ['a method that is not text', { requestContext: { http: { method: 1 } } }],
  ])('refuses %s', (_, event) => {
    expect(isFunctionUrlEvent(event)).toBe(false);
  });
});
