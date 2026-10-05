import { comesFromEdge, EDGE_SECRET_HEADER } from './edge-secret';

describe('comesFromEdge', () => {
  it('accepts the secret CloudFront adds to every request', () => {
    expect(comesFromEdge({ [EDGE_SECRET_HEADER]: 'edge-secret' }, 'edge-secret')).toBe(true);
  });

  it.each([
    ['a wrong secret of the same length', { [EDGE_SECRET_HEADER]: 'edge-secreT' }, 'edge-secret'],
    ['a wrong secret of another length', { [EDGE_SECRET_HEADER]: 'edge' }, 'edge-secret'],
    ['no header', {}, 'edge-secret'],
    ['no headers at all', undefined, 'edge-secret'],
    ['no configured secret', { [EDGE_SECRET_HEADER]: 'edge-secret' }, undefined],
    ['an empty configured secret', { [EDGE_SECRET_HEADER]: '' }, ''],
  ])('refuses %s', (_, headers, secret) => {
    expect(comesFromEdge(headers, secret)).toBe(false);
  });
});
