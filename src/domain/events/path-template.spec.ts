import { templatePath } from './path-template';

const PATH_TEMPLATE_CASES: readonly (readonly [string, string])[] = [
  ['/', '/'],
  ['/pricing', '/pricing'],
  ['/pricing/', '/pricing'],
  ['/pricing//', '/pricing'],
  ['//', '/'],
  ['/orders/42', '/orders/:id'],
  ['/orders/42/items/7', '/orders/:id/items/:id'],
  ['/orders/9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c', '/orders/:id'],
  ['/orders/12345678-1234-4234-8234-123456789012/edit', '/orders/:id/edit'],
  ['/clients/123.456.789-09', '/clients/:id'],
  ['/call/(11)98765-4321', '/call/:id'],
  ['/invoice-12345678901', '/:id'],
  ['/users/ana@example.com', '/users/:id'],
  ['/users/ana%40example.com', '/users/:id'],
  ['/users/ana%40Example.com/settings', '/users/:id/settings'],
  ['/blog/2026/black-friday', '/blog/:id/black-friday'],
  ['/v2/plans', '/v2/plans'],
  ['/orders/:id', '/orders/:id'],
];

describe('templatePath', () => {
  it.each(PATH_TEMPLATE_CASES)('turns %j into %j', (path, expected) => {
    expect(templatePath(path)).toBe(expected);
  });

  it.each(PATH_TEMPLATE_CASES)('is idempotent on %j', (path) => {
    const once = templatePath(path);

    expect(templatePath(once)).toBe(once);
  });
});
