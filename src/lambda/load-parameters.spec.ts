import { GetParametersByPathCommand, type SSMClient } from '@aws-sdk/client-ssm';
import { Logger } from '@nestjs/common';
import { loadParameters, type ParameterPage, ssmParameterPages } from './load-parameters';

describe('loadParameters', () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies every page of parameters under the prefix into the environment', async () => {
    const env: NodeJS.ProcessEnv = { CONFIG_PARAMETER_PREFIX: '/pyxis-api/app/' };
    const pages: Record<string, ParameterPage> = {
      first: {
        Parameters: [{ Name: '/pyxis-api/app/DATABASE_URL', Value: 'postgres://app' }],
        NextToken: 'second',
      },
      second: { Parameters: [{ Name: '/pyxis-api/app/EDGE_SHARED_SECRET', Value: 'edge' }] },
    };
    const fetchPage = jest.fn((_prefix: string, nextToken?: string) =>
      Promise.resolve(pages[nextToken ?? 'first'] ?? {}),
    );

    const loaded = await loadParameters(env, fetchPage);

    expect(loaded).toEqual(['DATABASE_URL', 'EDGE_SHARED_SECRET']);
    expect(env).toMatchObject({ DATABASE_URL: 'postgres://app', EDGE_SHARED_SECRET: 'edge' });
    expect(fetchPage.mock.calls).toEqual([
      ['/pyxis-api/app/', undefined],
      ['/pyxis-api/app/', 'second'],
    ]);
    expect(logs).toEqual([
      {
        message: 'parameters.loaded',
        prefix: '/pyxis-api/app/',
        names: ['DATABASE_URL', 'EDGE_SHARED_SECRET'],
      },
    ]);
  });

  it('keeps a variable already set in the environment and skips unusable entries', async () => {
    const env: NodeJS.ProcessEnv = {
      CONFIG_PARAMETER_PREFIX: '/pyxis-api/app/',
      DATABASE_URL: 'local',
    };

    const loaded = await loadParameters(env, () =>
      Promise.resolve({
        Parameters: [
          { Name: '/pyxis-api/app/DATABASE_URL', Value: 'postgres://app' },
          { Name: '/pyxis-api/app/NO_VALUE' },
          { Value: 'no name' },
          { Name: '/pyxis-api/app/', Value: 'empty name' },
        ],
      }),
    );

    expect(loaded).toEqual([]);
    expect(env.DATABASE_URL).toBe('local');
  });

  it('reads a page without parameters as empty', async () => {
    expect(
      await loadParameters({ CONFIG_PARAMETER_PREFIX: '/pyxis-api/app/' }, () =>
        Promise.resolve({}),
      ),
    ).toEqual([]);
  });

  it.each([undefined, ''])(
    'does nothing without a prefix (%j), as in local runs',
    async (prefix) => {
      const fetchPage = jest.fn();

      expect(await loadParameters({ CONFIG_PARAMETER_PREFIX: prefix }, fetchPage)).toEqual([]);
      expect(fetchPage).not.toHaveBeenCalled();
    },
  );
});

describe('ssmParameterPages', () => {
  it('asks Parameter Store for every decrypted parameter under the prefix', async () => {
    const send = jest.fn(() => Promise.resolve({ Parameters: [] }));

    await ssmParameterPages({ send } as unknown as SSMClient)('/pyxis-api/app/', 'token');

    const [command] = send.mock.calls[0] as unknown as [GetParametersByPathCommand];
    expect(command).toBeInstanceOf(GetParametersByPathCommand);
    expect(command.input).toEqual({
      Path: '/pyxis-api/app/',
      Recursive: true,
      WithDecryption: true,
      NextToken: 'token',
    });
  });

  it('builds its own client by default', () => {
    expect(typeof ssmParameterPages()).toBe('function');
  });
});
