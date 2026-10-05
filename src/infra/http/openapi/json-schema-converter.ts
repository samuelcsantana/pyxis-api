import type { StandardSchemaConversionResult, StandardSchemaConverter } from '@nestjs/swagger';

export const JSON_SCHEMA_TARGET = 'draft-2020-12';

type JsonSchemaDirection = 'input' | 'output';
type JsonSchemaEmitter = (options: { target: string }) => Record<string, unknown>;

interface StandardJsonSchemaHost {
  readonly '~standard': {
    readonly jsonSchema: Readonly<Record<JsonSchemaDirection, JsonSchemaEmitter>>;
  };
}

const OMITTED_KEYWORDS = new Set(['$schema', '$defs']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStandardJsonSchema(schema: unknown): schema is StandardJsonSchemaHost {
  if (!isRecord(schema)) {
    return false;
  }
  const standard = schema['~standard'];
  return isRecord(standard) && isRecord(standard.jsonSchema);
}

export function convertToJsonSchema(
  schema: unknown,
  direction: JsonSchemaDirection,
): StandardSchemaConversionResult | undefined {
  if (!hasStandardJsonSchema(schema)) {
    return undefined;
  }
  const converted = schema['~standard'].jsonSchema[direction]({ target: JSON_SCHEMA_TARGET });
  const definitions = converted.$defs;
  return {
    schema: Object.fromEntries(
      Object.entries(converted).filter(([keyword]) => !OMITTED_KEYWORDS.has(keyword)),
    ),
    components: isRecord(definitions) ? definitions : {},
  };
}

export const jsonSchemaConverter: StandardSchemaConverter = (schema, { schemaType }) =>
  convertToJsonSchema(schema, schemaType);
