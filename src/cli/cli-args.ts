import { parseArgs, type ParseArgsConfig } from 'node:util';
import { isUuid } from '../domain/events/text-shapes';

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

type Options = NonNullable<ParseArgsConfig['options']>;
export type ParsedValues = Readonly<
  Record<string, string | boolean | (string | boolean)[] | undefined>
>;

export function usageErrorFrom(error: unknown): CliUsageError {
  return new CliUsageError(error instanceof Error ? error.message : String(error));
}

export function parseCommandArgs(argv: readonly string[], options: Options): ParsedValues {
  try {
    return parseArgs({ args: [...argv], options, strict: true, allowPositionals: false }).values;
  } catch (error) {
    throw usageErrorFrom(error);
  }
}

export function optionalText(values: ParsedValues, name: string): string | undefined {
  const value = values[name];
  return typeof value === 'string' ? value : undefined;
}

export function requiredText(values: ParsedValues, name: string): string {
  const value = optionalText(values, name);
  if (value === undefined || value.trim() === '') {
    throw new CliUsageError(`--${name} is required.`);
  }
  return value;
}

export function textList(values: ParsedValues, name: string): string[] {
  const value = values[name];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function flag(values: ParsedValues, name: string): boolean {
  return values[name] === true;
}

export function requiredId(values: ParsedValues, name: string): string {
  const value = requiredText(values, name);
  if (!isUuid(value)) {
    throw new CliUsageError(`--${name} must be a UUID.`);
  }
  return value.toLowerCase();
}
