import { isLocalDevelopmentOrigin, sharedFreeSitesOf } from './shared-free-site';

const FREE_ACCOUNT = 'acc00000-0000-4000-a000-000000000001';
const SHOP = 'prj00000-0000-4000-a000-000000000001';
const BLOG = 'prj00000-0000-4000-a000-000000000002';
const OTHER_SHOP = 'prj00000-0000-4000-a000-000000000011';
const THIRD_SHOP = 'prj00000-0000-4000-a000-000000000012';

describe('isLocalDevelopmentOrigin', () => {
  it.each([
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://[::1]:8080',
    'http://shop.localhost:3000',
  ])('reads %s as a developer machine', (origin) => {
    expect(isLocalDevelopmentOrigin(origin)).toBe(true);
  });

  it.each(['https://shop.example.com', 'https://localhost.example.com', 'http://192.168.0.10'])(
    'reads %s as a site',
    (origin) => {
      expect(isLocalDevelopmentOrigin(origin)).toBe(false);
    },
  );
});

describe('sharedFreeSitesOf', () => {
  it('gathers, per project of a free account, the other projects that allow one of its origins', () => {
    expect(
      sharedFreeSitesOf([
        {
          accountId: FREE_ACCOUNT,
          projectId: SHOP,
          origin: 'https://shop.example.com',
          otherProjectId: THIRD_SHOP,
        },
        {
          accountId: FREE_ACCOUNT,
          projectId: SHOP,
          origin: 'https://www.shop.example.com',
          otherProjectId: OTHER_SHOP,
        },
        {
          accountId: FREE_ACCOUNT,
          projectId: SHOP,
          origin: 'https://shop.example.com',
          otherProjectId: OTHER_SHOP,
        },
        {
          accountId: FREE_ACCOUNT,
          projectId: BLOG,
          origin: 'https://blog.example.com',
          otherProjectId: OTHER_SHOP,
        },
      ]),
    ).toEqual([
      { accountId: FREE_ACCOUNT, projectId: SHOP, otherProjectIds: [OTHER_SHOP, THIRD_SHOP] },
      { accountId: FREE_ACCOUNT, projectId: BLOG, otherProjectIds: [OTHER_SHOP] },
    ]);
  });

  it('leaves out an origin of a developer machine, which many accounts allow while they build', () => {
    expect(
      sharedFreeSitesOf([
        {
          accountId: FREE_ACCOUNT,
          projectId: SHOP,
          origin: 'http://localhost:3000',
          otherProjectId: OTHER_SHOP,
        },
      ]),
    ).toEqual([]);
  });
});
