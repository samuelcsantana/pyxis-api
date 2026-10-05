import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Logger } from '@nestjs/common';

export interface StoredParameter {
  readonly Name?: string;
  readonly Value?: string;
}

export interface ParameterPage {
  readonly Parameters?: readonly StoredParameter[];
  readonly NextToken?: string;
}

export type ParameterPageFetcher = (prefix: string, nextToken?: string) => Promise<ParameterPage>;

const logger = new Logger('ParameterStore');

export function ssmParameterPages(client: SSMClient = new SSMClient({})): ParameterPageFetcher {
  return (prefix, nextToken) =>
    client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        Recursive: true,
        WithDecryption: true,
        NextToken: nextToken,
      }),
    );
}

function nameOf(parameter: StoredParameter): string | undefined {
  return parameter.Name?.split('/').pop();
}

export async function loadParameters(
  env: NodeJS.ProcessEnv,
  fetchPage: ParameterPageFetcher,
): Promise<readonly string[]> {
  const prefix = env.CONFIG_PARAMETER_PREFIX;
  if (prefix === undefined || prefix === '') {
    return [];
  }
  const loaded: string[] = [];
  let nextToken: string | undefined;
  do {
    const page = await fetchPage(prefix, nextToken);
    for (const parameter of page.Parameters ?? []) {
      const name = nameOf(parameter);
      if (
        name !== undefined &&
        name !== '' &&
        parameter.Value !== undefined &&
        env[name] === undefined
      ) {
        env[name] = parameter.Value;
        loaded.push(name);
      }
    }
    nextToken = page.NextToken;
  } while (nextToken !== undefined);
  logger.log({ message: 'parameters.loaded', prefix, names: [...loaded].sort() });
  return loaded;
}
