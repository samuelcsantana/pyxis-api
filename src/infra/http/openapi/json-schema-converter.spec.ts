import { z } from 'zod';
import { convertToJsonSchema, JSON_SCHEMA_TARGET, jsonSchemaConverter } from './json-schema-converter';

function fakeStandardSchema(emitted: Record<string, unknown>) {
  const emit = jest.fn(() => emitted);
  return { schema: { '~standard': { jsonSchema: { input: emit, output: emit } } }, emit };
}

describe('convertToJsonSchema', () => {
  it('converts a Zod schema to JSON Schema 2020-12 without the $schema keyword', () => {
    const result = convertToJsonSchema(z.object({ status: z.literal('ok') }), 'output');

    expect(result).toEqual({
      schema: {
        type: 'object',
        properties: { status: { type: 'string', const: 'ok' } },
        required: ['status'],
        additionalProperties: false,
      },
      components: {},
    });
  });

  it('asks the schema for the 2020-12 dialect in the requested direction', () => {
    const { schema, emit } = fakeStandardSchema({ type: 'string' });

    convertToJsonSchema(schema, 'input');

    expect(emit).toHaveBeenCalledWith({ target: JSON_SCHEMA_TARGET });
  });

  it('moves $defs into the components', () => {
    const { schema } = fakeStandardSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: '#/$defs/Event',
      $defs: { Event: { type: 'object' } },
    });

    expect(convertToJsonSchema(schema, 'output')).toEqual({
      schema: { $ref: '#/$defs/Event' },
      components: { Event: { type: 'object' } },
    });
  });

  it('ignores $defs that is not an object', () => {
    const { schema } = fakeStandardSchema({ type: 'string', $defs: 'broken' });

    expect(convertToJsonSchema(schema, 'output')).toEqual({
      schema: { type: 'string' },
      components: {},
    });
  });

  it.each([
    ['null', null],
    ['a string', 'schema'],
    ['an array', []],
    ['an object without ~standard', { type: 'string' }],
    ['a standard schema without a JSON Schema emitter', { '~standard': { validate: () => true } }],
  ])('leaves %s to the default conversion', (_label, schema) => {
    expect(convertToJsonSchema(schema, 'output')).toBeUndefined();
  });
});

describe('jsonSchemaConverter', () => {
  it('passes the schema type through as the direction', () => {
    const { schema, emit } = fakeStandardSchema({ type: 'number' });

    expect(jsonSchemaConverter(schema, { schemaType: 'input' })).toEqual({
      schema: { type: 'number' },
      components: {},
    });
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
