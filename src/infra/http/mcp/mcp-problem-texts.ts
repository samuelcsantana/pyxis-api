import type { ProblemTexts } from 'pyxis-mcp';
import type { McpBearer } from './mcp-caller';

const UNREACHABLE_ADVICE = 'Try again in a minute, or ask for a shorter range of dates.';

export const CONNECTION_PROBLEM_TEXTS: ProblemTexts = {
  refusedToken:
    'The connection to Pyxis was refused: it may have been revoked or have expired. Connect Pyxis again in Claude.',
  unreachableAdvice: UNREACHABLE_ADVICE,
};

export const ACCESS_TOKEN_PROBLEM_TEXTS: ProblemTexts = {
  refusedToken:
    'The access token was refused: it may be revoked or expired. Create another access token in the Pyxis dashboard, under Settings, Access tokens.',
  unreachableAdvice: UNREACHABLE_ADVICE,
};

export function problemTextsFor(bearer: McpBearer): ProblemTexts {
  switch (bearer.kind) {
    case 'access_token':
      return ACCESS_TOKEN_PROBLEM_TEXTS;
    case 'connection':
      return CONNECTION_PROBLEM_TEXTS;
  }
}
