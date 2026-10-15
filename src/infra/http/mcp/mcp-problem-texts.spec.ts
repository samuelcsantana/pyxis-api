import {
  ACCESS_TOKEN_PROBLEM_TEXTS,
  CONNECTION_PROBLEM_TEXTS,
  problemTextsFor,
} from './mcp-problem-texts';

describe('problemTextsFor', () => {
  it('asks the person behind a connection to connect Pyxis again', () => {
    const texts = problemTextsFor({ kind: 'connection', secret: 'pyxis_oat_x' });

    expect(texts).toBe(CONNECTION_PROBLEM_TEXTS);
    expect(texts.refusedToken).toContain('Connect Pyxis again in Claude');
  });

  it('asks the owner of a personal token to create another one', () => {
    const texts = problemTextsFor({ kind: 'access_token', secret: 'pyxis_at_x' });

    expect(texts).toBe(ACCESS_TOKEN_PROBLEM_TEXTS);
    expect(texts.refusedToken).toContain('Settings, Access tokens');
  });

  it('never names the settings of the local server', () => {
    for (const texts of [CONNECTION_PROBLEM_TEXTS, ACCESS_TOKEN_PROBLEM_TEXTS]) {
      expect(`${texts.refusedToken} ${texts.unreachableAdvice}`).not.toMatch(
        /PYXIS_(TOKEN|API_URL)/,
      );
    }
  });
});
