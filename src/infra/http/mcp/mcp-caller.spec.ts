import { mcpBearerOf } from './mcp-caller';

const ACCESS_TOKEN = `pyxis_at_${'A'.repeat(32)}`;
const CONNECTION_TOKEN = `pyxis_oat_${'B'.repeat(43)}`;

describe('mcpBearerOf', () => {
  it('reads a personal access token', () => {
    expect(mcpBearerOf(`Bearer ${ACCESS_TOKEN}`)).toEqual({
      kind: 'access_token',
      secret: ACCESS_TOKEN,
    });
  });

  it('reads the access token of a connection', () => {
    expect(mcpBearerOf(`Bearer ${CONNECTION_TOKEN}`)).toEqual({
      kind: 'connection',
      secret: CONNECTION_TOKEN,
    });
  });

  it.each([
    ['no header', undefined],
    ['another scheme', `Basic ${ACCESS_TOKEN}`],
    ['a secret project key', `Bearer pyxis_sk_${'C'.repeat(32)}`],
    ['a refresh token', `Bearer pyxis_ort_${'D'.repeat(43)}`],
    ['a malformed token', 'Bearer pyxis_oat_short'],
  ])('refuses %s', (_, header) => {
    expect(mcpBearerOf(header)).toBeNull();
  });
});
